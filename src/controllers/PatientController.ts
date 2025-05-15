import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthRequest } from "../middleware/authMiddleware";

const prisma = new PrismaClient();

class PatientController {
  async create(req: Request, res: Response): Promise<void> {
    try {
      const {
        name,
        email,
        cpf,
        phone,
        birthDate,
        address,
        city,
        state,
        zipCode,
        country,
        password, // Ensure password is included
        number,
        complement,
      } = req.body;

      const patient = await prisma.patient.create({
        data: {
          name,
          email,
          cpf,
          phone,
          birthDate: new Date(birthDate),
          address,
          city,
          state,
          zipCode,
          country,
          password: password,
          number: number,
          complement: complement,
        },
      });

      res.status(201).json(patient);
    } catch (error) {
      console.error("Erro ao cadastrar paciente:", error);
      res.status(500).json({ error: "Erro ao cadastrar paciente" });
    }
  }

  async listAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const patients = await prisma.patient.findMany();
      res.status(200).json(patients);
    } catch (error) {
      console.error("Erro ao listar pacientes:", error);
      res.status(500).json({ error: "Erro ao listar pacientes" });
    }
  }

  async getById(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      const patient = await prisma.patient.findUnique({
        where: { id: parseInt(id) },
      });
      if (!patient) {
        res.status(404).json({ error: "Paciente não encontrado" });
        return;
      }
      res.status(200).json(patient);
    } catch (error) {
      console.error("Erro ao buscar paciente:", error);
      res.status(500).json({ error: "Erro ao buscar paciente" });
    }
  }

  async update(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      const {
        name,
        email,
        cpf,
        phone,
        birthDate,
        address,
        city,
        state,
        zipCode,
        country,
        number,
        complement,
      } = req.body;

      const updatedPatient = await prisma.patient.update({
        where: { id: parseInt(id) },
        data: {
          name,
          email,
          cpf,
          phone,
          birthDate: new Date(birthDate),
          address,
          city,
          state,
          zipCode,
          country,
          number: number,
          complement: complement,
          updatedAt: new Date(),
        },
      });

      res.status(200).json(updatedPatient);
    } catch (error) {
      console.error("Erro ao atualizar paciente:", error);
      res.status(500).json({ error: "Erro ao atualizar paciente" });
    }
  }

  async delete(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      await prisma.patient.delete({
        where: { id: parseInt(id) },
      });
      res.status(204).send(); // 204 No Content para indicar sucesso na deleção
    } catch (error) {
      console.error("Erro ao deletar paciente:", error);
      res.status(500).json({ error: "Erro ao deletar paciente" });
    }
  }
}

export default new PatientController();