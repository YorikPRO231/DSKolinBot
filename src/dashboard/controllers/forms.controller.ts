import { Request, Response } from "express";
import { bindingsManager } from "../../utils/bindingsManager";
import { AppError } from "../middleware/errorHandler.middleware";

export class FormsController {
  static async getAll(req: Request, res: Response) {
    const bindings = bindingsManager.getAllBindings();
    res.json({ success: true, bindings });
  }

  static async create(req: Request, res: Response) {
    const { formId, channelId, guildId, formName, pingRoleId, pingRoleId2 } =
      req.body;

    if (!formId || !channelId || !guildId) {
      throw AppError.badRequest("formId, channelId and guildId are required");
    }

    const binding = bindingsManager.addBinding(
      'web',
      formId,
      channelId,
      guildId,
      formName || null,
      pingRoleId || null,
      pingRoleId2 || null,
    );

    res.json({ success: true, binding });
  }

  static async update(req: Request, res: Response) {
    const formId = req.params.formId as string;
    const { channelId, guildId, formName, pingRoleId, pingRoleId2 } = req.body;

    if (!channelId || !guildId) {
      throw AppError.badRequest("channelId and guildId are required");
    }

    const existingBinding = bindingsManager.getBinding(formId);
    if (!existingBinding) {
      throw AppError.notFound("Binding not found");
    }

    bindingsManager.removeBinding(formId);
    const binding = bindingsManager.addBinding(
      'web',
      formId,
      channelId,
      guildId,
      formName || null,
      pingRoleId || null,
      pingRoleId2 || null,
    );

    res.json({ success: true, binding });
  }

  static async delete(req: Request, res: Response) {
    const formId = req.params.formId as string;
    const deleted = bindingsManager.removeBinding(formId);

    if (!deleted) {
      throw AppError.notFound("Binding not found");
    }

    res.json({ success: true });
  }
}