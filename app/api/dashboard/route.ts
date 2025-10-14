import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../lib/auth/config'
import { successResponse, handleApiError, errorResponse } from '../../../lib/responses'
import { prisma } from '../../../lib/prisma/client'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return errorResponse('Não autorizado', 401)
    }

    const userId = session.user.id

    // Total de consultas
    const totalConsultations = await prisma.consultation.count({
      where: { userId },
    })

    // Total de profissionais únicos
    const uniqueProfessionals = await prisma.consultation.groupBy({
      by: ['professionalId'],
      where: {
        userId,
        professionalId: { not: null }, // Only count consultations with professionals
      },
      _count: true,
    })

    // Total de arquivos
    const totalFiles = await prisma.file.count({
      where: {
        consultation: {
          userId,
        },
      },
    })

    // Consultas por especialidade
    const consultationsBySpecialty = await prisma.consultation.findMany({
      where: { userId },
      include: {
        professional: {
          include: {
            specialties: {
              include: {
                specialty: true,
              },
            },
          },
        },
      },
    })

    const specialtyStats = consultationsBySpecialty.reduce((acc: Record<string, { name: string; count: number }>, consultation) => {
      if (consultation.professional) {
        consultation.professional.specialties.forEach((ps: { specialty: { name: string } }) => {
          const specialtyName = ps.specialty.name
          if (!acc[specialtyName]) {
            acc[specialtyName] = {
              name: specialtyName,
              count: 0,
            }
          }
          acc[specialtyName].count++
        })
      }
      return acc
    }, {})

    // Consultas por clínica
    const consultationsByClinic = await prisma.consultation.groupBy({
      by: ['professionalId'],
      where: {
        userId,
        professionalId: { not: null }, // Only include consultations with professionals
      },
      _count: true,
    })

    const clinicStats: any = {}
    for (const item of consultationsByClinic) {
      if (item.professionalId) {
        const professional = await prisma.professional.findUnique({
          where: { id: item.professionalId },
          include: { clinic: true },
        })
        if (professional?.clinic) {
          if (!clinicStats[professional.clinic.name]) {
            clinicStats[professional.clinic.name] = {
              name: professional.clinic.name,
              count: 0,
            }
          }
          clinicStats[professional.clinic.name].count += item._count
        }
      }
    }

    // Consultas por ano
    const consultationsByYear = await prisma.consultation.findMany({
      where: { userId },
      select: { date: true },
    })

    const yearStats = consultationsByYear.reduce((acc: Record<number, { year: string; count: number }>, consultation) => {
      const year = new Date(consultation.date).getFullYear()
      if (!acc[year]) {
        acc[year] = {
          year: year.toString(),
          count: 0,
        }
      }
      acc[year].count++
      return acc
    }, {})

    // Consultas por profissional (top 10)
    const consultationsByProfessional = await prisma.consultation.groupBy({
      by: ['professionalId'],
      where: {
        userId,
        professionalId: { not: null }, // Only include consultations with professionals
      },
      _count: true,
      orderBy: {
        _count: {
          professionalId: 'desc',
        },
      },
      take: 10,
    })

    const professionalStats = await Promise.all(
      consultationsByProfessional.map(async (item) => {
        if (!item.professionalId) {
          return {
            name: 'Desconhecido',
            specialty: '',
            count: item._count,
          }
        }

        const professional = await prisma.professional.findUnique({
          where: { id: item.professionalId },
          select: {
            name: true,
            specialties: {
              include: {
                specialty: true,
              },
            },
          },
        })
        return {
          name: professional?.name || 'Desconhecido',
          specialty: professional?.specialties[0]?.specialty.name || '',
          count: item._count,
        }
      })
    )

    // Consultas por mês (últimos 12 meses)
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

    const recentConsultations = await prisma.consultation.findMany({
      where: {
        userId,
        date: {
          gte: twelveMonthsAgo,
        },
      },
      select: { date: true },
    })

    const monthStats = recentConsultations.reduce((acc: Record<string, { month: string; count: number }>, consultation) => {
      const date = new Date(consultation.date)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      if (!acc[monthKey]) {
        acc[monthKey] = {
          month: monthKey,
          count: 0,
        }
      }
      acc[monthKey].count++
      return acc
    }, {})

    // Consultas recentes
    const recentConsultationsList = await prisma.consultation.findMany({
      where: { userId },
      take: 5,
      orderBy: { date: 'desc' },
      include: {
        professional: {
          include: {
            specialties: {
              include: {
                specialty: true,
              },
            },
          },
        },
      },
    })

    const recentFormatted = recentConsultationsList.map((c: { id: string; date: Date; type: string; professional: { name: string; specialties: Array<{ specialty: { name: string } }> } | null }) => ({
      id: c.id,
      date: c.date,
      type: c.type,
      professionalName: c.professional?.name || '-',
      specialty: c.professional?.specialties[0]?.specialty.name || '-',
    }))

    return successResponse(
      {
        summary: {
          totalConsultations,
          totalProfessionals: uniqueProfessionals.length,
          totalFiles,
        },
        bySpecialty: Object.values(specialtyStats).sort((a: any, b: any) => b.count - a.count),
        byClinic: Object.values(clinicStats).sort((a: any, b: any) => b.count - a.count),
        byYear: Object.values(yearStats).sort((a: any, b: any) => parseInt(b.year) - parseInt(a.year)),
        byProfessional: professionalStats,
        byMonth: Object.values(monthStats).sort((a: any, b: any) => a.month.localeCompare(b.month)),
        recentConsultations: recentFormatted,
      },
      'Estatísticas carregadas com sucesso'
    )
  } catch (error) {
    return handleApiError(error)
  }
}
