use crate::half_2_view::Half2View;
use crate::half_2_bits::Half2Bits;
use half::f16;

pub trait HoughSamples<'a> {
    type Iter: Iterator<Item = (f32, f32)> + 'a;
    fn iter_hough_samples(&'a self) -> Self::Iter;
}

impl<'a> HoughSamples<'a> for Half2View<'a> {
    type Iter = std::iter::Map<
        std::slice::Iter<'a, Half2Bits>,
        fn(&Half2Bits) -> (f32, f32),
    >;

    fn iter_hough_samples(&'a self) -> Self::Iter {
        fn map_fn(h: &Half2Bits) -> (f32, f32) {
            (
                f32::from(f16::from_bits(h.x)),
                f32::from(f16::from_bits(h.y)),
            )
        }

        self.as_bits().iter().map(map_fn)
    }
}
