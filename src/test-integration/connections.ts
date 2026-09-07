export const POSTGRES_URL =
  process.env["KOSAME_TEST_POSTGRES_URL"] ?? "postgres://kosame:kosame@localhost:55432/kosame_test";

export const MYSQL_URL = process.env["KOSAME_TEST_MYSQL_URL"] ?? "mysql://kosame:kosame@localhost:33307/kosame_test";
