pub struct HoughAccumulator {
    pub theta_bins: usize,
    pub rho_bins: usize,
    pub data: Vec<f32>,
}

impl HoughAccumulator {
    pub fn new(theta_bins: usize, rho_bins: usize) -> Self {
        Self {
            theta_bins,
            rho_bins,
            data: vec![0.0; theta_bins * rho_bins],
        }
    }

    #[inline(always)]
    pub fn vote(&mut self, theta_norm: f32, rho_norm: f32, weight: f32) {
        // theta_norm ∈ [0,1)
        // rho_norm ∈ [-1,1]

        let mut t = (theta_norm * self.theta_bins as f32) as isize;
        let mut r = ((rho_norm * 0.5 + 0.5) * self.rho_bins as f32) as isize;

        // optional clamp (safer for FP noise)
        t = t.clamp(0, self.theta_bins as isize - 1);
        r = r.clamp(0, self.rho_bins as isize - 1);

        let idx = (t as usize) * self.rho_bins + (r as usize);
        self.data[idx] += weight;
    }

    #[inline(always)]
    pub fn get(&self, t: usize, r: usize) -> f32 {
        self.data[t * self.rho_bins + r]
    }
}
