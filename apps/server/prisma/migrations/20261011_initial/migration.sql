-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'ADMIN', 'TECHNICIAN');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('AVAILABLE', 'RENTED', 'MAINTENANCE', 'SOLD');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'ACTIVE_RENTAL', 'RETURNED_PENDING_INSPECTION', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('PENDING', 'HELD', 'REFUNDED', 'DEDUCTED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'DELIVERING', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
    "kycStatus" "KycStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "idCardNumber" TEXT,
    "idCardFrontUrl" TEXT,
    "idCardBackUrl" TEXT,
    "eSignatureUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "modelName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "categoryId" TEXT,
    "sensorType" TEXT NOT NULL DEFAULT 'APS-C',
    "resolutionMp" DOUBLE PRECISION,
    "videoSpecs" TEXT,
    "hasIbis" BOOLEAN NOT NULL DEFAULT false,
    "weightGrams" INTEGER NOT NULL,
    "recommendedPurpose" TEXT NOT NULL,
    "dailyRentalRate" INTEGER NOT NULL,
    "referenceUsedPrice" BIGINT NOT NULL,
    "thumbnailUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CameraItem" (
    "id" SERIAL NOT NULL,
    "modelId" INTEGER NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "shutterCount" INTEGER,
    "conditionGrade" TEXT NOT NULL,
    "sensorInspection" TEXT,
    "opticsCondition" TEXT NOT NULL,
    "scratchNotes" TEXT NOT NULL,
    "depositAmount" INTEGER NOT NULL,
    "status" "ItemStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CameraItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalBooking" (
    "id" TEXT NOT NULL,
    "bookingCode" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cameraItemId" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "totalDays" INTEGER NOT NULL,
    "dailyRate" INTEGER NOT NULL,
    "totalRentalFee" INTEGER NOT NULL,
    "depositAmount" INTEGER NOT NULL,
    "depositStatus" "DepositStatus" NOT NULL DEFAULT 'PENDING',
    "contractSigned" BOOLEAN NOT NULL DEFAULT false,
    "contractSignatureUrl" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "deliveryMethod" TEXT NOT NULL DEFAULT 'STORE_PICKUP',
    "customerNotes" TEXT,
    "returnInspectionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderCode" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cameraItemId" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "paymentMethod" TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
    "warrantyMonths" INTEGER NOT NULL DEFAULT 6,
    "warrantyExpiresAt" TIMESTAMP(3) NOT NULL,
    "shippingAddress" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "CameraItem_serialNumber_key" ON "CameraItem"("serialNumber");

-- CreateIndex
CREATE INDEX "CameraItem_modelId_idx" ON "CameraItem"("modelId");

-- CreateIndex
CREATE UNIQUE INDEX "RentalBooking_bookingCode_key" ON "RentalBooking"("bookingCode");

-- CreateIndex
CREATE INDEX "RentalBooking_userId_idx" ON "RentalBooking"("userId");

-- CreateIndex
CREATE INDEX "RentalBooking_cameraItemId_idx" ON "RentalBooking"("cameraItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderCode_key" ON "Order"("orderCode");

-- CreateIndex
CREATE UNIQUE INDEX "Order_cameraItemId_key" ON "Order"("cameraItemId");

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "Order"("userId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CameraItem" ADD CONSTRAINT "CameraItem_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalBooking" ADD CONSTRAINT "RentalBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalBooking" ADD CONSTRAINT "RentalBooking_cameraItemId_fkey" FOREIGN KEY ("cameraItemId") REFERENCES "CameraItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_cameraItemId_fkey" FOREIGN KEY ("cameraItemId") REFERENCES "CameraItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
