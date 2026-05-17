import { ImageRequireSource } from 'react-native';
import { ProgramId } from './programs';

export const PROGRAM_IMAGES: Record<ProgramId, ImageRequireSource> = {
  individual: require('../../assets/images/programs/individual.jpeg'),
  gruppe: require('../../assets/images/programs/gruppe.jpg'),
  athletik: require('../../assets/images/programs/athletik.jpeg'),
  torhueter_individual: require('../../assets/images/programs/torwart_individual.jpg'),
  torhueter_gruppe: require('../../assets/images/programs/torwart_gruppe.jpg'),
};
