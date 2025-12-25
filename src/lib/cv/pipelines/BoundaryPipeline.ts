import { ComputerVisionPipeline } from "../ComputerVisionPipeline";
import type { PassBase } from "../passes/PassBase";
import { BilateralPass } from "../passes/bilateral/BilateralPass";
import { BilateralPassSettings } from "../passes/bilateral/BilateralPassSettings";
import { Rec709LumPass } from "../passes/rec-709-luma/Rec709LumaPass";
import { OrientationPass } from "../passes/orientation/OrientationPass";
import { OrientationPassSettings } from "../passes/orientation/OrientationPassSettings";
import { StructurePass } from "../passes/structure/StructurePass";
import { StructurePassSettings } from "../passes/structure/StructurePassSettings";
import { TemporalPass } from "../passes/temporal/TemporalPass";
import { TemporalPassSettings } from "../passes/temporal/TemporalPassSettings";
import { DownscalePass } from "../passes/downscale/DownscalePass";
import { PassSettingsBase } from "../passes/PassSettingsBase";
import { RayBoxPass } from "../passes/ray-box/RayBoxPass";
import { RayBoxPassSettings } from "../passes/ray-box/RayBoxPassSettings";
import type { Box } from "../../geometry/Box";

export type BoundaryPipelinePass = {
  id: string
  label: string
  required: boolean
  pass: PassBase
}

export type BoundaryOutput = { box: Box | null }

export class BoundaryPipeline extends ComputerVisionPipeline<BoundaryOutput> {
  public readonly passes: BoundaryPipelinePass[]
  private passMap: Map<string, BoundaryPipelinePass>
  private rayBoxPass: RayBoxPass

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas) {
    super(canvas)

    const rec709 = new Rec709LumPass(this.gl)

    const orientationSettings = new OrientationPassSettings()
    orientationSettings.flipX = false
    orientationSettings.flipY = false
    const orientation = new OrientationPass(this.gl, orientationSettings)

    const temporalSettings = new TemporalPassSettings()
    temporalSettings.enabled = true
    const temporal = new TemporalPass(this.gl, temporalSettings)

    const bilateralSettings = new BilateralPassSettings()
    bilateralSettings.kernelRadius = 2
    bilateralSettings.sigmaSpatial = 2.0
    bilateralSettings.sigmaRange = 0.1
    const bilateral = new BilateralPass(this.gl, bilateralSettings)

    const downscaleSettings = new PassSettingsBase()
    const downscale = new DownscalePass(this.gl, downscaleSettings)

    const structureSettings = new StructurePassSettings()
    structureSettings.magnitudeThreshold = 0.8
    structureSettings.continuityThreshold = 0.8
    const structure = new StructurePass(this.gl, structureSettings)

    const rayBoxSettings = new RayBoxPassSettings()
    rayBoxSettings.threshold = 0.12
    rayBoxSettings.rayCount = 64
    rayBoxSettings.step = 0.5
    rayBoxSettings.trimFraction = 0.12
    this.rayBoxPass = new RayBoxPass(this.gl, rayBoxSettings)

    this.passes = [
      { id: 'rec709-luma', label: 'Rec709 Luma', required: true, pass: rec709 },
      { id: 'orientation', label: 'Orientation', required: false, pass: orientation },
      { id: 'temporal', label: 'Temporal Median', required: false, pass: temporal },
      { id: 'bilateral', label: 'Bilateral', required: false, pass: bilateral },
      { id: 'downscale', label: 'Downscale', required: false, pass: downscale },
      { id: 'sobel', label: 'Structure', required: false, pass: structure },
      { id: 'ray-box', label: 'Ray Box', required: false, pass: this.rayBoxPass },
    ]
    this.passMap = new Map(this.passes.map((p) => [p.id, p]))

    for (const entry of this.passes) {
      this.addPass(entry.pass)
    }
  }

  public getPass(id: string): PassBase | undefined {
    return this.passMap.get(id)?.pass
  }

  protected postprocess(): BoundaryOutput {
    return { box: this.rayBoxPass.lastBox }
  }
}
