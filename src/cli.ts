import path from "node:path";
import { runChecker } from "./checker.js";
import { loadConfig } from "./config.js";
import { parseDateOnly } from "./dates.js";
import { formatAcceptedDealsForConsole } from "./report.js";

interface CliArgs {
  config: string;
  out: string;
  fixturePath: string;
  accorSnapshotPath: string;
  apartmentCandidatePath: string;
  bookingSnapshotPath: string;
  today: string | null;
  noWriteState: boolean;
  help: boolean;
}

export async function run(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return 0;
  }

  const config = await loadConfig(args.config);
  const check = await runChecker(config, {
    today: args.today ? parseDateOnly(args.today) : new Date(),
    rootDir: process.cwd(),
    outDir: args.out,
    writeReports: true,
    writeState: !args.noWriteState,
    sourcePaths: {
      fixture: args.fixturePath,
      accorSnapshot: args.accorSnapshotPath,
      apartmentCandidate: args.apartmentCandidatePath,
      bookingSnapshot: args.bookingSnapshotPath
    }
  });

  console.log(formatAcceptedDealsForConsole(check.results, config));
  const sourceErrors = check.sources.filter((source) => source.status === "error");
  for (const source of sourceErrors) {
    console.warn(`Source warning: ${source.name}: ${source.error}`);
  }
  console.log("");
  console.log(
    `Wrote ${check.results.length} ranked candidates to ${path.join(args.out, "travel-deals.md")} and ${path.join(args.out, "travel-deals.json")}`
  );
  return 0;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    config: "config.example.json",
    out: "reports",
    fixturePath: "data/fixture_listings.json",
    accorSnapshotPath: "data/accor_live_snapshot.json",
    apartmentCandidatePath: "data/apartment_candidate_snapshot.json",
    bookingSnapshotPath: "data/booking_live_snapshot.json",
    today: null,
    noWriteState: false,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    switch (token) {
      case "--config":
        args.config = requiredValue(argv, ++index, token);
        break;
      case "--out":
        args.out = requiredValue(argv, ++index, token);
        break;
      case "--fixture-path":
        args.fixturePath = requiredValue(argv, ++index, token);
        break;
      case "--accor-snapshot-path":
        args.accorSnapshotPath = requiredValue(argv, ++index, token);
        break;
      case "--apartment-candidate-path":
        args.apartmentCandidatePath = requiredValue(argv, ++index, token);
        break;
      case "--booking-snapshot-path":
        args.bookingSnapshotPath = requiredValue(argv, ++index, token);
        break;
      case "--today":
        args.today = requiredValue(argv, ++index, token);
        break;
      case "--no-write-state":
        args.noWriteState = true;
        break;
      case "--help":
      case "-h":
        args.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${token}`);
    }
  }

  return args;
}

function requiredValue(argv: string[], index: number, flag: string): string {
  const value = argv[index];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
  return value;
}

function printHelp(): void {
  console.log(`Usage: npm run deals -- [options]

Options:
  --config <path>        Config file path. Default: config.example.json
  --out <path>           Output directory. Default: reports
  --fixture-path <path>  Fixture data path. Default: data/fixture_listings.json
  --accor-snapshot-path <path> Accor live snapshot path. Default: data/accor_live_snapshot.json
  --apartment-candidate-path <path> Apartment candidate snapshot path. Default: data/apartment_candidate_snapshot.json
  --booking-snapshot-path <path> Booking.com connector snapshot path. Default: data/booking_live_snapshot.json
  --today <YYYY-MM-DD>   Override current date for deterministic runs.
  --no-write-state       Do not update seen-results state.
  --help                 Show this help.
`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
