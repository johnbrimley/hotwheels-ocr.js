import { PassSettingsBase } from "../PassSettingsBase";

export class MagnatudeGatePassSettings extends PassSettingsBase {
    public get threshold(): number {
        return this.uniforms['u_threshold'];
    }
    public set threshold(value: number) {
        this.uniforms['u_threshold'] = value;
    }
}
