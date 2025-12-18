import { PassSettingsBase } from "../PassSettingsBase";

export class BilateralPassSettings extends PassSettingsBase {
    public get sigmaSpatial(): number {
        return this.uniforms['u_sigmaSpatial'];
    }
    public set sigmaSpatial(value: number) {
        this.uniforms['u_sigmaSpatial'] = value;
    }
    public get sigmaRange(): number {
        return this.uniforms['u_sigmaRange'];
    }
    public set sigmaRange(value: number) {
        this.uniforms['u_sigmaRange'] = value;
    }
    public get radius(): number {
        return this.uniforms['u_radius'];
    }
    public set radius(value: number) {
        this.uniforms['u_radius'] = value;
    }
}