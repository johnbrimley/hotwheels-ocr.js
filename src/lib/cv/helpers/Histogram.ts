export class Histogram {
    private buckets: number[];
    private scale: number[];
    private values: number[];

    private minValue: number = Number.POSITIVE_INFINITY;
    private maxValue: number = Number.NEGATIVE_INFINITY;
    private valueIndex: number = 0;

    constructor(
        private bucketCount: number,
        private size: number
    ) {
        this.buckets = new Array(bucketCount).fill(0);
        this.scale   = new Array(bucketCount).fill(0);
        this.values  = new Array(size);
    }

    public reset(size: number): void {
        this.buckets.fill(0);
        this.scale.fill(0);
        if (size !== this.size) {
            this.size = size;
            this.values = new Array(size);
        }
        this.values.fill(0);
        this.minValue = Number.POSITIVE_INFINITY;
        this.maxValue = Number.NEGATIVE_INFINITY;
        this.valueIndex = 0;
    }

    public addValue(value: number): void {
        if (this.valueIndex >= this.size) {
            throw new Error("Histogram is full");
        }

        this.values[this.valueIndex++] = value;

        if (value < this.minValue) this.minValue = value;
        if (value > this.maxValue) this.maxValue = value;
    }

    public calculate(): void {
        if (this.valueIndex === 0) return;

        // Edge case: all values identical
        if (this.minValue === this.maxValue) {
            this.buckets[0] = this.valueIndex;
            this.scale[0] = 1.0;
            return;
        }

        const invRange = 1.0 / (this.maxValue - this.minValue);

        // Fill histogram
        for (let i = 0; i < this.valueIndex; i++) {
            const v = this.values[i];

            let bucket =
                Math.floor(
                    (v - this.minValue) * invRange * (this.bucketCount - 1)
                );

            // Safety clamp
            if (bucket < 0) bucket = 0;
            if (bucket >= this.bucketCount) bucket = this.bucketCount - 1;

            this.buckets[bucket]++;
        }

        // Build cumulative distribution (CDF)
        let cumulative = 0;
        const invTotal = 1.0 / this.valueIndex;

        for (let i = 0; i < this.bucketCount; i++) {
            cumulative += this.buckets[i];
            this.scale[i] = cumulative * invTotal;
        }
    }

    /**
     * Returns the value threshold at the given percentile.
     * percentile ∈ [0, 1]
     */
    public getPercentile(percentile: number): number {
        if (this.valueIndex === 0) {
            return 0;
        }

        percentile = Math.min(Math.max(percentile, 0), 1);

        for (let i = 0; i < this.bucketCount; i++) {
            if (this.scale[i] >= percentile) {
                const t = i / (this.bucketCount - 1);
                return this.minValue + t * (this.maxValue - this.minValue);
            }
        }

        // Fallback (should not happen)
        return this.maxValue;
    }
}
