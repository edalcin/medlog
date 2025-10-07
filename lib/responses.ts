import { NextResponse } from 'next/server'
import { AppError } from './errors'

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export function successResponse<T>(
  data: T,
  message?: string,
  status: number = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      message,
    },
    { status }
  )
}

export function errorResponse(
  error: string | Error,
  status: number = 500
): NextResponse<ApiResponse> {
  const message = error instanceof Error ? error.message : error

  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status }
  )
}

export function handleApiError(error: unknown): NextResponse<ApiResponse> {
  console.error('API Error:', error)

  if (error instanceof AppError) {
    return errorResponse(error.message, error.statusCode)
  }

  if (error instanceof Error) {
    return errorResponse(error.message, 500)
  }

  return errorResponse('Erro interno do servidor', 500)
}