use bytemuck::cast_slice;

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

    pub fn as_f32_slice(&self) -> &'a [f32] {
        cast_slice(self.bytes)
    }
}
