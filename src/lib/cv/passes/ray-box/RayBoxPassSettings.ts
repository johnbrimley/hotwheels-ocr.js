import { PassSettingsBase } from "../PassSettingsBase";

export class RayBoxPassSettings extends PassSettingsBase {
    /* ================= CPU-only fields ================= */

    private _threshold = 0.2;
    private _rayCount = 64;
    private _step = 0.5;
    private _trimFraction = 0.12;

    // kept for compatibility / future use
    private _angleThreshold = 0;
    private _distanceThreshold = 0;

    /* ================= Accessors ================= */

    public get threshold(): number {
        return this._threshold;
    }
    public set threshold(value: number) {
        this._threshold = value;
    }

    public get rayCount(): number {
        return this._rayCount;
    }
    public set rayCount(value: number) {
        this._rayCount = value;
    }

    public get step(): number {
        return this._step;
    }
    public set step(value: number) {
        this._step = value;
    }

    public get trimFraction(): number {
        return this._trimFraction;
    }
    public set trimFraction(value: number) {
        this._trimFraction = value;
    }

    public get angleThreshold(): number {
        return this._angleThreshold;
    }
    public set angleThreshold(value: number) {
        this._angleThreshold = value;
    }

    public get distanceThreshold(): number {
        return this._distanceThreshold;
    }
    public set distanceThreshold(value: number) {
        this._distanceThreshold = value;
    }
}

