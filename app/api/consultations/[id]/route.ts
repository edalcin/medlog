import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../lib/auth/config'
import { successResponse, handleApiError, errorResponse } from '../../../../lib/responses'
import { NotFoundError, ValidationError } from '../../../../lib/errors'

const prisma = new PrismaClient()

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return errorResponse('Não autorizado', 401)
    }

    const consultation = await prisma.consultation.findUnique({
      where: {
        id: params.id,
      },
      include: {
        professional: {
          select: {
            id: true,
            name: true,
            crm: true,
            specialties: {
              include: {
                specialty: true,
              },
            },
          },
        },
        files: {
          select: {
            id: true,
            filename: true,
            customName: true,
            path: true,
            mimeType: true,
            size: true,
            uploadedAt: true,
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    if (!consultation) {
      throw new NotFoundError('Consulta')
    }

    // Check if user owns this consultation or is admin
    if (consultation.userId !== session.user.id && session.user.role !== 'ADMIN') {
      return errorResponse('Não autorizado', 403)
    }

    // Transform to flatten specialties
    const transformedConsultation = {
      ...consultation,
      professional: {
        ...consultation.professional,
        specialties: consultation.professional.specialties.map((ps) => ps.specialty),
      },
    }

    return successResponse(transformedConsultation, 'Consulta encontrada com sucesso')
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return errorResponse('Não autorizado', 401)
    }

    const body = await request.json()
    const { date, professionalId, proposito, notes } = body

    // Validate required fields
    if (!date || !professionalId) {
      throw new ValidationError('Data e profissional são obrigatórios')
    }

    // Validate date format and ensure it's not in the future
    const consultationDate = new Date(date)
    const now = new Date()
    if (isNaN(consultationDate.getTime())) {
      throw new ValidationError('Data inválida')
    }
    if (consultationDate > now) {
      throw new ValidationError('Data da consulta não pode ser no futuro')
    }

    // Check if consultation exists and user owns it
    const existingConsultation = await prisma.consultation.findUnique({
      where: { id: params.id },
    })

    if (!existingConsultation) {
      throw new NotFoundError('Consulta')
    }

    // Check if user owns this consultation or is admin
    if (existingConsultation.userId !== session.user.id && session.user.role !== 'ADMIN') {
      return errorResponse('Não autorizado', 403)
    }

    // Check if professional exists and is active
    const professional = await prisma.professional.findFirst({
      where: {
        id: professionalId,
        isActive: true,
      },
    })

    if (!professional) {
      throw new NotFoundError('Profissional')
    }

    // Update consultation
    const consultation = await prisma.consultation.update({
      where: { id: params.id },
      data: {
        date: consultationDate,
        proposito: proposito || null,
        notes: notes || null,
        professionalId,
      },
      include: {
        professional: {
          select: {
            id: true,
            name: true,
            specialties: {
              include: {
                specialty: true,
              },
            },
          },
        },
        files: {
          select: {
            id: true,
            filename: true,
            mimeType: true,
            size: true,
            uploadedAt: true,
          },
        },
      },
    })

    // Transform to flatten specialties
    const transformedConsultation = {
      ...consultation,
      professional: {
        ...consultation.professional,
        specialties: consultation.professional.specialties.map((ps) => ps.specialty),
      },
    }

    return successResponse(
      transformedConsultation,
      'Consulta atualizada com sucesso'
    )
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return errorResponse('Não autorizado', 401)
    }

    // Check if consultation exists and user owns it
    const existingConsultation = await prisma.consultation.findUnique({
      where: { id: params.id },
      include: {
        files: {
          select: {
            path: true,
          },
        },
      },
    })

    if (!existingConsultation) {
      throw new NotFoundError('Consulta')
    }

    // Check if user owns this consultation or is admin
    if (existingConsultation.userId !== session.user.id && session.user.role !== 'ADMIN') {
      return errorResponse('Não autorizado', 403)
    }

    // Delete physical files before deleting consultation
    const fs = require('fs')
    const path = require('path')
    const uploadsDir = process.env.FILES_PATH || path.join(process.cwd(), 'uploads')

    for (const file of existingConsultation.files) {
      try {
        const filePath = path.join(uploadsDir, file.path)
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      } catch (fileError) {
        console.error(`Erro ao deletar arquivo físico ${file.path}:`, fileError)
        // Continue even if file deletion fails
      }
    }

    // Delete consultation (files records will be cascade deleted)
    await prisma.consultation.delete({
      where: { id: params.id },
    })

    return successResponse({}, 'Consulta e arquivos removidos com sucesso')
  } catch (error) {
    return handleApiError(error)
  }
}
