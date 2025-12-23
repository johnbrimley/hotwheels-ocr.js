export class ContinuityScore {
    static OFFSETS: Array<[number, number]> = [
        [-1, -1],
        [-1, 0],
        [-1, 1],
        [0, -1],
        [0, 1],
        [1, -1],
        [1, 0],
        [1, 1],
    ];

    public neighborXOffset: number;
    public neighborYOffset: number;
    public score: number;

    constructor(r: number, g: number, b: number, a: number) {
        // Direction index stored in R (0..7)
        const direction = r & 0xff;

        const [dx, dy] = ContinuityScore.OFFSETS[direction];
        this.neighborXOffset = dx;
        this.neighborYOffset = dy;

        // Score stored as 24-bit UNORM in GBA
        const u24 =
            ((g & 0xff) << 16) |
            ((b & 0xff) << 8) |
            ((a & 0xff) << 0);

        this.score = u24 / 16777215.0; // 2^24 - 1
    }
}
