-- Alone in this file, deliberately. Postgres refuses to USE a new enum value in
-- the transaction that adds it, and each migration file runs in its own
-- transaction — so anything referencing 'refunded' must land in a later file.
-- See 20260822090200_order_board.sql.
--
-- 'refunded' is distinct from 'cancelled' because the stock consequence is
-- opposite: a cancelled order never left the pass and its stock returns; a
-- refunded one was eaten and it does not.
alter type order_status add value 'refunded';
