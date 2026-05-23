import { Body, Controller, Get, Post } from "@nestjs/common";

import { RequireRole } from "../access/require-role.decorator.js";
import type {
  PilotWorkflowResponse,
  PilotWorkflowService,
} from "./pilot-workflow.service.js";

@Controller("pilot")
export class PilotWorkflowController {
  constructor(private readonly pilotWorkflowService: PilotWorkflowService) {}

  @Get("scenarios")
  @RequireRole("reader")
  getScenarios(): Array<{ id: string; title: string }> {
    return this.pilotWorkflowService.getSupportedScenarios();
  }

  @Post("runs")
  @RequireRole("editor")
  runPilotScenario(@Body() payload: unknown): Promise<PilotWorkflowResponse> {
    return this.pilotWorkflowService.run(payload);
  }
}
