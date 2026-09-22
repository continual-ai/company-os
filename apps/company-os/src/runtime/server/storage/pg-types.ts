import { PgTypes } from "@effect/sql-pg"
import { Result } from "effect"

/** Match portable model values at the driver boundary; nested JSON stays untouched. */
export const pgTypes = PgTypes.makeRegistry()

// PostgreSQL timestamps are signed microseconds since 2000-01-01; Date truncates them.
pgTypes.register(
  PgTypes.OID.timestamptz,
  {
    encode: (value) => PgTypes.encode(value, PgTypes.OID.timestamptz),
    decode: (bytes) =>
      Result.flatMap(
        PgTypes.decode(bytes, PgTypes.OID.timestamptz, 1),
        (value) => {
          if (!(value instanceof Date) || !Number.isFinite(value.getTime()))
            return Result.fail(
              new PgTypes.CodecError({ message: "Expected a finite timestamp" })
            )
          const micros = new DataView(
            bytes.buffer,
            bytes.byteOffset,
            bytes.byteLength
          ).getBigInt64(0)
          const remainder = ((micros % 1000n) + 1000n) % 1000n
          const iso = new Date(
            Number((micros - remainder) / 1000n) + 946684800000
          ).toISOString()
          return Result.succeed(
            remainder === 0n
              ? iso
              : `${iso.slice(0, -1)}${String(remainder).padStart(3, "0")}Z`
          )
        }
      ),
  },
  { arrayOid: PgTypes.OID.timestamptzArray }
)
