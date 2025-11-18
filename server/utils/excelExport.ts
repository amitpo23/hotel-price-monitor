import ExcelJS from "exceljs";

interface HotelPriceData {
  hotelName: string;
  checkInDate: string;
  roomType: string;
  price: number | null;
  isAvailable: boolean;
}

interface ExportData {
  configName: string;
  targetHotelName: string;
  scanDate: Date;
  results: HotelPriceData[];
}

export async function generateExcelReport(data: ExportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  
  workbook.creator = "Hotel Price Monitor";
  workbook.created = new Date();
  
  // Summary Sheet
  const summarySheet = workbook.addWorksheet("Summary", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 1 }],
  });

  // Header styling
  const headerStyle = {
    font: { bold: true, size: 12, color: { argb: "FFFFFFFF" } },
    fill: { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF4472C4" } },
    alignment: { vertical: "middle" as const, horizontal: "center" as const },
    border: {
      top: { style: "thin" as const },
      left: { style: "thin" as const },
      bottom: { style: "thin" as const },
      right: { style: "thin" as const },
    },
  };

  // Summary information
  summarySheet.addRow(["Hotel Price Monitoring Report"]);
  summarySheet.getRow(1).font = { bold: true, size: 16 };
  summarySheet.addRow([]);
  summarySheet.addRow(["Configuration:", data.configName]);
  summarySheet.addRow(["Target Hotel:", data.targetHotelName]);
  summarySheet.addRow(["Scan Date:", data.scanDate.toLocaleDateString()]);
  summarySheet.addRow([]);

  // Group results by hotel
  const hotelGroups = data.results.reduce((acc, result) => {
    if (!acc[result.hotelName]) {
      acc[result.hotelName] = [];
    }
    acc[result.hotelName].push(result);
    return acc;
  }, {} as Record<string, HotelPriceData[]>);

  // Statistics summary
  summarySheet.addRow(["Hotel Statistics"]);
  summarySheet.getRow(7).font = { bold: true, size: 14 };
  summarySheet.addRow([]);

  const statsHeaders = ["Hotel Name", "Avg Price (ILS)", "Min Price (ILS)", "Max Price (ILS)", "Availability %"];
  const statsHeaderRow = summarySheet.addRow(statsHeaders);
  statsHeaderRow.eachCell((cell) => {
    cell.style = headerStyle;
  });

  Object.entries(hotelGroups).forEach(([hotelName, results]) => {
    const prices = results.filter((r) => r.price !== null).map((r) => r.price!);
    const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
    const availabilityRate = (results.filter((r) => r.isAvailable).length / results.length) * 100;

    const row = summarySheet.addRow([
      hotelName,
      Math.round(avgPrice / 100),
      Math.round(minPrice / 100),
      Math.round(maxPrice / 100),
      `${Math.round(availabilityRate)}%`,
    ]);

    // Highlight target hotel
    if (hotelName === data.targetHotelName) {
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFD966" },
        };
        cell.font = { bold: true };
      });
    }
  });

  // Auto-fit columns
  summarySheet.columns.forEach((column) => {
    column.width = 20;
  });

  // Detailed Data Sheet
  const detailSheet = workbook.addWorksheet("Detailed Data", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 1 }],
  });

  const detailHeaders = ["Hotel Name", "Check-In Date", "Room Type", "Price (ILS)", "Available"];
  const detailHeaderRow = detailSheet.addRow(detailHeaders);
  detailHeaderRow.eachCell((cell) => {
    cell.style = headerStyle;
  });

  // Sort results by date and hotel
  const sortedResults = [...data.results].sort((a, b) => {
    const dateCompare = a.checkInDate.localeCompare(b.checkInDate);
    if (dateCompare !== 0) return dateCompare;
    return a.hotelName.localeCompare(b.hotelName);
  });

  sortedResults.forEach((result) => {
    const row = detailSheet.addRow([
      result.hotelName,
      result.checkInDate,
      result.roomType === "room_only" ? "Room Only" : "With Breakfast",
      result.price !== null ? Math.round(result.price / 100) : "N/A",
      result.isAvailable ? "Yes" : "No",
    ]);

    // Color code availability
    const availCell = row.getCell(5);
    if (result.isAvailable) {
      availCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFC6EFCE" },
      };
    } else {
      availCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFC7CE" },
      };
    }

    // Highlight target hotel rows
    if (result.hotelName === data.targetHotelName) {
      row.eachCell((cell, colNumber) => {
        if (colNumber !== 5) {
          // Don't override availability color
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFF2CC" },
          };
        }
      });
    }
  });

  // Auto-fit columns
  detailSheet.columns.forEach((column) => {
    column.width = 18;
  });

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
