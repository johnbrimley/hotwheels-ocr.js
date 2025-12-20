import { PassSettingsBase } from "../PassSettingsBase";

// Uniforms remain for API compatibility; shader ignores them.
export class SobelPassSettings extends PassSettingsBase {
    // thetaRadius, rhoRadius, magnatudeScale, lengthScale
    private _thetaRadius: number = 1;
    private _rhoRadius: number = 1;
    private _magnitudeScale: number = 1.0;
    private _lengthScale: number = 1.0;

    public get thetaRadius(): number {
        return this._thetaRadius;
    }
    public set thetaRadius(value: number) {
        this._thetaRadius = value;
    }
    public get rhoRadius(): number {
        return this._rhoRadius;
    }
    public set rhoRadius(value: number) {
        this._rhoRadius = value;
    }
    public get magnitudeScale(): number {
        return this._magnitudeScale;
    }
    public set magnitudeScale(value: number) {
        this._magnitudeScale = value;
    }
    public get lengthScale(): number {
        return this._lengthScale;
    }
    public set lengthScale(value: number) {
        this._lengthScale = value;
    }
    public get diagonalWeaking(): number {
        return this.uniforms['u_diagonalWeakening'];
    }
    public set diagonalWeaking(value: number) {
        this.uniforms['u_diagonalWeakening'] = value;
    }

}
