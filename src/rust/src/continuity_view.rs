use crate::continuity::Continuity;

const OFFSETS: [(i8, i8); 8] = [
    (-1, -1), (-1,  0), (-1,  1),
    ( 0, -1),           ( 0,  1),
    ( 1, -1), ( 1,  0), ( 1,  1),
];

pub struct ContinuityView<'a> {
    bytes: &'a [u8],
}

impl<'a> ContinuityView<'a> {
    pub fn new(bytes: &'a [u8]) -> Self {
        assert!(bytes.len() % 4 == 0);
        Self { bytes }
    }

    #[inline]
    pub fn len(&self) -> usize {
        self.bytes.len() / 4
    }

    #[inline]
    pub fn get(&self, index: usize) -> Continuity {
        let i = index * 4;
        let b = &self.bytes[i..i + 4];

        // directions byte: pos << 4 | neg
        let d = b[0];
        let pos_i = (d >> 4) & 0x0F;
        let neg_i =  d       & 0x0F;

        let pos = OFFSETS[pos_i as usize];
        let neg = OFFSETS[neg_i as usize];

        // 24-bit UNORM score
        let scoreUnorm24 =
              (b[1] as u32)
            | ((b[2] as u32) << 8)
            | ((b[3] as u32) << 16);

        //score to float: (score as f32) / 16777215.0;
        let score = (scoreUnorm24 as f32) / 16777215.0;

        Continuity { pos, neg, score }
    }
}
