use bytemuck::{Pod, Zeroable};

#[repr(C)]
#[derive(Copy, Clone, Pod, Zeroable)]
pub struct Half2Bits {
    pub x: u16,
    pub y: u16,
}