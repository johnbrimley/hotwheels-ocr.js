import { PassSettingsBase } from "../PassSettingsBase";
import * as wasm from "../../../../wasm/hotwheels-ocr-wasm.js";

// Uniforms remain for API compatibility; shader ignores them.
export class StructurePassSettings extends PassSettingsBase {
    private _conitinuityThreshold: number = 0.1;
    private _magnitudeThreshold: number = 0.2;

    public get continuityThreshold(): number {
        return this._conitinuityThreshold;
    }
    public set continuityThreshold(value: number) {
        this._conitinuityThreshold = value;
    }

    public get magnitudeThreshold(): number {
        return this._magnitudeThreshold;
    }
    public set magnitudeThreshold(value: number) {
        this._magnitudeThreshold = value;
    }      

    public toRustStruct(): wasm.StructurePassSettings
    {
        return new wasm.StructurePassSettings(this._conitinuityThreshold, this._magnitudeThreshold);
    }
}
