#[derive(Clone, Copy, Debug)]
pub struct Continuity {
    pub pos:   (i8, i8),
    pub neg:   (i8, i8),
    pub score: f32, // 24-bit UNORM, raw
}
