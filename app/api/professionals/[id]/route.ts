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

    const professional = await prisma.professional.findUnique({
      where: {
        id: params.id,
      },
      include: {
        specialties: {
          include: {
            specialty: true,
          },
        },
        clinic: true,
      },
    })

    if (!professional) {
      throw new NotFoundError('Profissional')
    }

    // Transform to include specialty names
    const transformedProfessional = {
      ...professional,
      specialties: professional.specialties.map((ps) => ps.specialty),
    }

    return successResponse(transformedProfessional, 'Profissional encontrado com sucesso')
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const session = await getServerSession(authOptions)
        if (session?.user?.role !== 'ADMIN') {
            return errorResponse('Não autorizado', 403)
        }

        const body = await request.json()
        const { name, crm, phone, address, notes, isActive, clinicId, specialtyIds } = body

        if (!name) {
            throw new ValidationError('Nome é obrigatório')
        }

        if (!specialtyIds || !Array.isArray(specialtyIds) || specialtyIds.length === 0) {
            throw new ValidationError('Selecione pelo menos uma especialidade')
        }

        // Update professional and replace specialties
        const professional = await prisma.professional.update({
            where: { id: params.id },
            data: {
                name,
                crm: crm || null,
                phone: phone || null,
                address: address || null,
                notes: notes || null,
                isActive,
                clinicId: clinicId || null,
                specialties: {
                    deleteMany: {}, // Remove all existing specialty associations
                    create: specialtyIds.map((specialtyId: string) => ({
                        specialtyId,
                    })),
                },
            },
            include: {
                specialties: {
                    include: {
                        specialty: true,
                    },
                },
                clinic: true,
            },
        })

        // Transform to include specialty names
        const transformedProfessional = {
            ...professional,
            specialties: professional.specialties.map((ps) => ps.specialty),
        }

        return successResponse(transformedProfessional, 'Profissional atualizado com sucesso')
    } catch (error) {
        return handleApiError(error)
    }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const session = await getServerSession(authOptions)
        if (session?.user?.role !== 'ADMIN') {
            return errorResponse('Não autorizado', 403)
        }

        // Check if professional exists
        const professional = await prisma.professional.findUnique({
            where: { id: params.id },
            include: {
                _count: {
                    select: {
                        consultations: true,
                    },
                },
            },
        })

        if (!professional) {
            throw new NotFoundError('Profissional')
        }

        // Check if professional has consultations
        if (professional._count.consultations > 0) {
            return errorResponse(
                `Não é possível excluir este profissional pois existem ${professional._count.consultations} consulta(s) associada(s). Desative o profissional em vez de excluí-lo.`,
                400
            )
        }

        await prisma.professional.delete({
            where: { id: params.id },
        })

        return successResponse({}, 'Profissional removido com sucesso')
    } catch (error) {
        return handleApiError(error)
    }
}
