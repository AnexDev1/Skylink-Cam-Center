-- CreateTable
CREATE TABLE "SiteAccess" (
    "userId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,

    CONSTRAINT "SiteAccess_pkey" PRIMARY KEY ("userId","siteId")
);

-- CreateIndex
CREATE INDEX "SiteAccess_siteId_idx" ON "SiteAccess"("siteId");

-- AddForeignKey
ALTER TABLE "SiteAccess" ADD CONSTRAINT "SiteAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteAccess" ADD CONSTRAINT "SiteAccess_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
