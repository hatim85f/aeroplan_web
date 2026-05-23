import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';

const guidelineBaseWidth = 390;
const fontSizeReduction = 1.5;

export const globalWidth = (percentage) => wp(percentage);
export const globalHeight = (percentage) => hp(percentage);

export const scaleFont = (size) => {
  const adjustedSize = Math.max(size - fontSizeReduction, 8);
  return globalWidth(`${(adjustedSize / guidelineBaseWidth) * 100}%`);
};
