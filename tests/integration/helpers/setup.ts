export async function setup() {
  const url = process.env["DATABASE_URL_TEST"] ?? process.env["DATABASE_URL"];
  if (url) {
    process.env["DATABASE_URL"] = url;
  }
}

export async function teardown() {}
