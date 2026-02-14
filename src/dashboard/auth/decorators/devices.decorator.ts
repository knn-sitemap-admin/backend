import { SetMetadata } from '@nestjs/common';

export const DEVICES_KEY = 'devices';
export const Devices = (...devices: ('pc' | 'mobile')[]) =>
  SetMetadata(DEVICES_KEY, devices);
