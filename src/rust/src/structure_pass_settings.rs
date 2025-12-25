use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct StructurePassSettings {
    pub continuity_threshold: f32,
    pub magnitude_threshold: f32,
}

#[wasm_bindgen]
impl StructurePassSettings {
    #[wasm_bindgen(constructor)]
    pub fn new(continuity_threshold: f32, magnitude_threshold: f32) -> Self {
        StructurePassSettings {
            continuity_threshold,
            magnitude_threshold,
        }
    }
}
