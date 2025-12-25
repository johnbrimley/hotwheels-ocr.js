pub struct HoughSample {
    pub theta: f32,
    pub rho: f32,
}

impl<'a> Half2View<'a> {
    pub fn iter_hough_samples(&self) -> impl Iterator<Item = HoughSample> + 'a {
        self.bits.iter().map(|h| HoughSample {
            theta: f16::from_bits(h.x).to_f32(),
            rho:   f16::from_bits(h.y).to_f32(),
        })
    }
}