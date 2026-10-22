-- Reconstruction of the lost wave's GradeAck table (2026-10-23): the file
-- died in a reprovision after applying to the live DB; this reproduces the
-- exact applied shape (verified against sqlite_master) so fresh databases
-- converge. The design it carried - a separate ack store keyed by a client
-- gid holding the full response JSON - was superseded in the same wave by
-- the lighter clientRef column on ReviewLog (0006_offline_clientref);
-- 0008_offline_ack_consolidate drops this table so both paths end identical.
CREATE TABLE "GradeAck" (
    "gid" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)
