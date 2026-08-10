import type { StatewidePresidentialResult } from "../../packages/election-model/src/scenario.ts";

export interface StateDatum extends StatewidePresidentialResult {
  name: string;
  column: number;
  row: number;
}

function state(
  code: string,
  name: string,
  totalVotes: number,
  harrisVotes: number,
  trumpVotes: number,
  harrisElectoralVotes: number,
  trumpElectoralVotes: number,
  column: number,
  row: number,
): StateDatum {
  return {
    code,
    name,
    totalVotes,
    harrisVotes,
    trumpVotes,
    otherVotes: totalVotes - harrisVotes - trumpVotes,
    harrisElectoralVotes,
    trumpElectoralVotes,
    column,
    row,
  };
}

// Official statewide vote totals compiled by the Federal Election Commission
// from state election offices. Maine and Nebraska retain their certified split
// electoral-vote allocations in the baseline.
export const states2024: readonly StateDatum[] = [
  state("AL", "Alabama", 2_265_090, 772_412, 1_462_616, 0, 9, 8, 5),
  state("AK", "Alaska", 338_177, 140_026, 184_458, 0, 3, 1, 6),
  state("AZ", "Arizona", 3_390_161, 1_582_860, 1_770_242, 0, 11, 2, 4),
  state("AR", "Arkansas", 1_182_676, 396_905, 759_241, 0, 6, 6, 4),
  state("CA", "California", 15_865_475, 9_276_179, 6_081_697, 54, 0, 1, 4),
  state("CO", "Colorado", 3_192_745, 1_728_159, 1_377_441, 10, 0, 4, 3),
  state("CT", "Connecticut", 1_759_010, 992_053, 736_918, 7, 0, 13, 3),
  state("DE", "Delaware", 512_912, 289_758, 214_351, 3, 0, 12, 3),
  state("DC", "District of Columbia", 325_869, 294_185, 21_076, 3, 0, 11, 4),
  state("FL", "Florida", 10_893_752, 4_683_038, 6_110_125, 0, 30, 10, 6),
  state("GA", "Georgia", 5_250_905, 2_548_017, 2_663_117, 0, 16, 9, 5),
  state("HI", "Hawaii", 516_701, 313_044, 193_661, 4, 0, 2, 6),
  state("ID", "Idaho", 905_057, 274_972, 605_246, 0, 4, 2, 2),
  state("IL", "Illinois", 5_633_310, 3_062_863, 2_449_079, 19, 0, 7, 2),
  state("IN", "Indiana", 2_936_677, 1_163_603, 1_720_347, 0, 11, 8, 2),
  state("IA", "Iowa", 1_663_506, 707_278, 927_019, 0, 6, 6, 2),
  state("KS", "Kansas", 1_327_591, 544_853, 758_802, 0, 6, 5, 3),
  state("KY", "Kentucky", 2_074_530, 704_043, 1_337_494, 0, 8, 8, 3),
  state("LA", "Louisiana", 2_006_975, 766_870, 1_208_505, 0, 8, 6, 5),
  state("ME", "Maine", 831_375, 435_652, 377_977, 3, 1, 14, 1),
  state("MD", "Maryland", 3_038_334, 1_902_577, 1_035_550, 10, 0, 11, 3),
  state("MA", "Massachusetts", 3_473_668, 2_126_518, 1_251_303, 11, 0, 12, 2),
  state("MI", "Michigan", 5_664_186, 2_736_533, 2_816_636, 0, 15, 8, 1),
  state("MN", "Minnesota", 3_253_920, 1_656_979, 1_519_032, 10, 0, 6, 1),
  state("MS", "Mississippi", 1_228_008, 466_668, 747_744, 0, 6, 7, 5),
  state("MO", "Missouri", 2_995_327, 1_200_599, 1_751_986, 0, 10, 6, 3),
  state("MT", "Montana", 602_990, 231_906, 352_079, 0, 4, 3, 1),
  state("NE", "Nebraska", 952_182, 369_995, 564_816, 1, 4, 5, 2),
  state("NV", "Nevada", 1_484_840, 705_197, 751_205, 0, 6, 2, 3),
  state("NH", "New Hampshire", 826_189, 418_488, 395_523, 4, 0, 13, 1),
  state("NJ", "New Jersey", 4_272_725, 2_220_713, 1_968_215, 14, 0, 11, 2),
  state("NM", "New Mexico", 923_403, 478_802, 423_391, 5, 0, 3, 4),
  state("NY", "New York", 8_262_495, 4_619_195, 3_578_899, 28, 0, 11, 1),
  state("NC", "North Carolina", 5_699_141, 2_715_375, 2_898_423, 0, 16, 10, 4),
  state("ND", "North Dakota", 368_155, 112_327, 246_505, 0, 3, 4, 1),
  state("OH", "Ohio", 5_767_788, 2_533_699, 3_180_116, 0, 17, 9, 2),
  state("OK", "Oklahoma", 1_566_173, 499_599, 1_036_213, 0, 7, 5, 4),
  state("OR", "Oregon", 2_244_493, 1_240_600, 919_480, 8, 0, 1, 2),
  state("PA", "Pennsylvania", 7_058_732, 3_423_042, 3_543_308, 0, 19, 10, 2),
  state("RI", "Rhode Island", 513_386, 285_156, 214_406, 4, 0, 13, 2),
  state("SC", "South Carolina", 2_548_140, 1_028_452, 1_483_747, 0, 9, 10, 5),
  state("SD", "South Dakota", 428_922, 146_859, 272_081, 0, 3, 4, 2),
  state("TN", "Tennessee", 3_063_942, 1_056_265, 1_966_865, 0, 11, 8, 4),
  state("TX", "Texas", 11_388_674, 4_835_250, 6_393_597, 0, 40, 5, 5),
  state("UT", "Utah", 1_488_494, 562_566, 883_818, 0, 6, 3, 3),
  state("VT", "Vermont", 369_422, 235_791, 119_395, 3, 0, 12, 1),
  state("VA", "Virginia", 4_503_288, 2_333_778, 2_074_097, 13, 0, 10, 3),
  state("WA", "Washington", 3_924_243, 2_245_849, 1_530_923, 12, 0, 1, 1),
  state("WV", "West Virginia", 762_582, 214_309, 533_556, 0, 4, 9, 3),
  state("WI", "Wisconsin", 3_422_918, 1_668_229, 1_697_626, 0, 10, 7, 1),
  state("WY", "Wyoming", 269_048, 69_527, 192_633, 0, 3, 3, 2),
] as const;

export const fec2024Source = {
  label: "Federal Election Commission, official 2024 presidential results",
  url: "https://www.fec.gov/resources/cms-content/documents/2024presgeresults.pdf",
};
