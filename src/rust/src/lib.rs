use wasm_bindgen::prelude::*;

pub mod half_2_view;
pub mod half_2_bits;
pub mod float_view;
pub mod structure_pass_settings;
pub mod continuity_view;
pub mod continuity;
pub mod hough_sample;
pub mod hough_samples;


use crate::half_2_view::Half2View;
use crate::float_view::FloatView;
use crate::continuity_view::ContinuityView;
use crate::structure_pass_settings::StructurePassSettings;
use crate::continuity::Continuity;
use crate::hough_sample::HoughSample;
use crate::hough_samples::HoughSamples;

const THETA_BINS: usize = 64;
const RHO_BINS: usize = 128;

#[derive(Clone, Copy)]
struct EdgeSample {
    theta_bin: u16,
    rho_bin: u16,
    magnitude: f32,
}

#[wasm_bindgen]
pub fn draw(settings: StructurePassSettings, magnitude_bytes: &[u8], continuity_bytes: &[u8], hough_bytes: &[u8]) -> Vec<f32> {
    let magnitude = FloatView::new(magnitude_bytes).as_f32_slice();
    let hough     = Half2View::new(hough_bytes).iter_hough_samples();
    let continuity = ContinuityView::new(continuity_bytes);

    let mut luma = vec![0.0f32; magnitude.len()];
    for i in 0..magnitude.len() {
        let mag = magnitude[i];
        //let (theta_norm, rho_norm) = hough.get(i);
        let continuity = continuity.get(i);

        if mag < settings.magnitude_threshold {
            continue;
        }
        if continuity.score < settings.continuity_threshold {
            continue;
        }
        
        luma[i] = mag;
    }
    luma
}
