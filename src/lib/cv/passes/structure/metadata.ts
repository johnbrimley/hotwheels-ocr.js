import type { DifferenceOfGaussians } from "../../models/DifferenceOfGaussians";
import type { ContinuityScore } from "../../models/ContinuityScore";

export interface Metadata{
    index: number;
    continuityScore: ContinuityScore
    nextContinuityScoreIndex: number;
    magnitude: number;
}