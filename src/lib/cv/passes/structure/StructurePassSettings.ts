import { PassSettingsBase } from "../PassSettingsBase";

// Uniforms remain for API compatibility; shader ignores them.
export class StructurePassSettings extends PassSettingsBase {
    /*
    u_sigmaSmall
    u_sigmaLarge
    */
   public get sigmaSmall(): number {
        return this.uniforms['u_sigmaSmall'];
    }
    public set sigmaSmall(value: number) {
        this.uniforms['u_sigmaSmall'] = value;
    }

    public get sigmaLarge(): number {
        return this.uniforms['u_sigmaLarge'];
    }
    public set sigmaLarge(value: number) {
        this.uniforms['u_sigmaLarge'] = value;
    }
}
