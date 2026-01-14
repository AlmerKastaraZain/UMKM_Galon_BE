// This file is modular. You can add more methods easily.

exports.processQRIS = async (amount, orderId) => {
    // Logic for Midtrans / Xendit goes here
    console.log(`Generating QRIS for Rp${amount}`);
    return { qr_url: "https://api.midtrans.com/v2/qris/...", expiry: "15m" };
};

exports.processTransfer = async (amount) => {
    // Logic for Virtual Account (VA)
    return { va_number: "880123456789", bank: "BCA" };
};

exports.processCash = async () => {
    return { message: "Pay the driver upon arrival, Sir." };
};