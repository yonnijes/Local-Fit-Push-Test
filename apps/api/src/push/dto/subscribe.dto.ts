import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MAX_INTERVAL_SECONDS, MIN_INTERVAL_SECONDS } from '../push.types';

export class PushKeysDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  @Matches(/^[A-Za-z0-9\-_]+={0,2}$/, {
    message: 'p256dh debe ser una clave base64url válida',
  })
  p256dh!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  @Matches(/^[A-Za-z0-9\-_]+={0,2}$/, {
    message: 'auth debe ser una clave base64url válida',
  })
  auth!: string;
}

export class SubscribeDto {
  @IsUrl(
    { protocols: ['https'], require_protocol: true, require_tld: true },
    { message: 'endpoint debe ser una URL HTTPS válida' },
  )
  @MaxLength(2048)
  endpoint!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  expirationTime?: number | null;

  @ValidateNested()
  @Type(() => PushKeysDto)
  keys!: PushKeysDto;
}

export class StartDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'intervalSeconds debe ser un número entero' })
  @Min(MIN_INTERVAL_SECONDS, {
    message: `intervalSeconds debe ser al menos ${MIN_INTERVAL_SECONDS}`,
  })
  @Max(MAX_INTERVAL_SECONDS, {
    message: `intervalSeconds no puede superar ${MAX_INTERVAL_SECONDS}`,
  })
  intervalSeconds?: number;
}
