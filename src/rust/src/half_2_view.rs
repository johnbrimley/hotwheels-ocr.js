use bytemuck::cast_slice;
use crate::half_2_bits::Half2Bits;

pub struct Half2View<'a> {
    bits: &'a [Half2Bits],
}

impl<'a> Half2View<'a> {
    pub fn new(bytes: &'a [u8]) -> Self {
        assert!(bytes.len() % 4 == 0);
        Self {
            bits: cast_slice(bytes),
        }
    }

    #[inline]
    pub fn as_bits(&self) -> &'a [Half2Bits] {
        self.bits
    }

    #[inline]
    pub fn len(&self) -> usize {
        self.bits.len()
    }
}
