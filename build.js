/* eslint-disable no-undef */
const fs = require("fs-extra");
const childProcess = require("child_process");
const createHash = require("crypto").createHash;
const { promisify } = require("util");
const { resolve } = require("path");
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

const BUILD_DIR = "./dist";
const BUILD_CHECKSUM_FILE = `${BUILD_DIR}/.build-checksum`;
const SOURCE_DIR = "./src";

const main = async () => {
  try {
    console.log("Calculating checksum of current build...");

    const lastBuildChecksum = !fs.existsSync(BUILD_CHECKSUM_FILE)
      ? undefined
      : fs.readFileSync(BUILD_CHECKSUM_FILE, "utf8");

    const files = await readdirRecursive(SOURCE_DIR);

    const currentBuildChecksum = files.reduce((acc, file) => {
      const contents = fs.readFileSync(file, "utf8");
      const md5Hash = createHash("md5").update(contents).digest("hex");
      return acc + md5Hash;
    }, "");

    if (lastBuildChecksum === currentBuildChecksum) {
      console.log("No changes since last build, skipping.");
      return;
    }

    if (fs.existsSync(BUILD_DIR)) {
      console.log("Removing current build...");
      fs.removeSync(BUILD_DIR);
    }

    fs.mkdirSync(BUILD_DIR);

    console.log("Building project...");
    const buildStartTimeMs = new Date().getTime();
    const proc = childProcess.exec("tsc --build tsconfig.prod.json");

    proc.stdout.on("data", (data) => {
      console.log("\x1b[90m%s\x1b[0m", data);
    });
    proc.stderr.on("data", (data) => {
      console.log("\x1b[31m%s\x1b[0m", data);
    });
    proc.on("close", (code) => {
      const buildEndTimeMs = new Date().getTime();
      const buildTimeMs = buildEndTimeMs - buildStartTimeMs;
      console.log(`Build ran in ${buildTimeMs}ms`);
      if (code !== 0) {
        console.error(`Build failed with code ${code}`);
        proc.kill();
        throw Error("Build failed");
      }

      fs.writeFileSync(BUILD_CHECKSUM_FILE, currentBuildChecksum, {
        encoding: "utf8",
      });
    });
  } catch (err) {
    console.error(err);
  }
};

/**
 * Read all files in a directory recursively.
 *
 * Returns a promise that resolves to an array of file paths.
 *
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function readdirRecursive(dir) {
  const subdirs = await readdir(dir);
  const files = await Promise.all(
    subdirs.map(async (subdir) => {
      const res = resolve(dir, subdir);
      return (await stat(res)).isDirectory() ? readdirRecursive(res) : res;
    })
  );
  return files.reduce((a, f) => a.concat(f), []);
}

main();
