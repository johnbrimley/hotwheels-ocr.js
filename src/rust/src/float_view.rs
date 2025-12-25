/// View over RGBA8-packed IEEE-754 f32 values
///
/// Layout per element:
///   bytes 0..3: little-endian f32 bits
pub struct FloatView<'a> {
    bytes: &'a [u8],
}

impl<'a> FloatView<'a> {
    pub fn new(bytes: &'a [u8]) -> Self {
        assert!(bytes.len() % 4 == 0);
        Self { bytes }
    }

    #[inline]
    pub fn len(&self) -> usize {
        self.bytes.len() / 4
    }

    /// Read the exact f32 value written by the GPU
    #[inline]
    pub fn get(&self, index: usize) -> f32 {
        let i = index * 4;
        let b = &self.bytes[i..i + 4];

        let bits = u32::from_le_bytes([b[0], b[1], b[2], b[3]]);
        f32::from_bits(bits)
    }
}
