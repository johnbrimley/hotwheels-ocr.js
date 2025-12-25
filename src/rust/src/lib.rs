use wasm_bindgen::prelude::*;

pub mod half_2_view;
pub mod float_view;

use crate::half_2_view::Half2View;
use crate::float_view::FloatView;

const THETA_BINS: usize = 64;
const RHO_BINS: usize = 128;

#[derive(Clone, Copy)]
struct EdgeSample {
    theta_bin: u16,
    rho_bin: u16,
    magnitude: f32,
}

#[wasm_bindgen]
pub fn draw(magnitude_bytes: &[u8], hough_bytes: &[u8]) -> Vec<f32> {
    let magnitude = FloatView::new(magnitude_bytes);
    let hough     = Half2View::new(hough_bytes);

    if magnitude.len() != hough.len() {
        panic!(
            "Mismatched lengths: magnitude {}, hough {}",
            magnitude.len(),
            hough.len()
        );
    }

    let len = magnitude.len();

    // ------------------------------------------------------------
    // Quantize ONCE (this is the critical fix)
    // ------------------------------------------------------------

    let theta_scale = THETA_BINS as f32 / std::f32::consts::PI;
    let rho_scale   = (RHO_BINS - 1) as f32; // IMPORTANT

    let mut samples: Vec<EdgeSample> = Vec::with_capacity(len);

    for i in 0..len {
        let mag = magnitude.get(i);
        let (theta, rho) = hough.get(i);

        let ti = (theta * theta_scale)
            .floor()
            .clamp(0.0, (THETA_BINS - 1) as f32) as u16;

        let ri = (rho * rho_scale)
            .floor()
            .clamp(0.0, (RHO_BINS - 1) as f32) as u16;

        samples.push(EdgeSample {
            theta_bin: ti,
            rho_bin: ri,
            magnitude: mag,
        });
    }

    // ------------------------------------------------------------
    // Hough accumulator (magnitude-weighted)
    // ------------------------------------------------------------

    let mut hough_acc = vec![0.0f32; THETA_BINS * RHO_BINS];

    for s in &samples {
        let idx = s.theta_bin as usize * RHO_BINS + s.rho_bin as usize;
        hough_acc[idx] += s.magnitude;
    }

    // ------------------------------------------------------------
    // Find strongest bucket (exactly one)
    // ------------------------------------------------------------

    let mut best_idx = 0usize;
    let mut best_val = 0.0f32;

    for (i, &v) in hough_acc.iter().enumerate() {
        if v > best_val {
            best_val = v;
            best_idx = i;
        }
    }

    let best_theta_bin = best_idx / RHO_BINS;
    let best_rho_bin   = best_idx % RHO_BINS;

    // ------------------------------------------------------------
    // Output mask (ONLY pixels that voted for that bin)
    // ------------------------------------------------------------

    let mut luma = vec![0.0f32; len];

    for (i, s) in samples.iter().enumerate() {
        if s.theta_bin as usize == best_theta_bin &&
           s.rho_bin   as usize == best_rho_bin
        {
            luma[i] = 1.0;
        }
    }

    luma
}
