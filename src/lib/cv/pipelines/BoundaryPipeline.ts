import { ComputerVisionPipeline } from '../ComputerVisionPipeline'
import type { PassBase } from '../passes/PassBase'
import { BilateralPass } from '../passes/bilateral/BilateralPass'
import { BilateralPassSettings } from '../passes/bilateral/BilateralPassSettings'
import { Rec709LumPass } from '../passes/rec-709-luma/Rec709LumaPass'

export type BoundaryPipelinePass = {
  id: string
  label: string
  required: boolean
  pass: PassBase
}

export class BoundaryPipeline {
  public readonly pipeline: ComputerVisionPipeline
  public readonly passes: BoundaryPipelinePass[]
  private passMap: Map<string, BoundaryPipelinePass>

  constructor(gl: WebGL2RenderingContext) {
    this.pipeline = new ComputerVisionPipeline(gl)

    const rec709 = new Rec709LumPass(gl)

    const bilateralSettings = new BilateralPassSettings()
    bilateralSettings.kernelRadius = 2
    bilateralSettings.sigmaSpatial = 2.0
    bilateralSettings.sigmaRange = 0.1
    const bilateral = new BilateralPass(gl, bilateralSettings)

    this.passes = [
      { id: 'rec709-luma', label: 'Rec709 Luma', required: true, pass: rec709 },
      { id: 'bilateral', label: 'Bilateral', required: false, pass: bilateral },
    ]
    this.passMap = new Map(this.passes.map((p) => [p.id, p]))

    for (const entry of this.passes) {
      this.pipeline.addPass(entry.pass)
    }
  }

  public getPass(id: string): PassBase | undefined {
    return this.passMap.get(id)?.pass
  }
}
