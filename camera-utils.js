function createSafeFilename(brand, model) {
    const fullName = `${brand}-${model}`.toLowerCase();
    const safeName = fullName
        .replace(/[\/\\:*?"<>|\s]+/g, '-')
        .replace(/\-+/g, '-')
        .replace(/^-+|-+$/g, '');
    return safeName;
}

module.exports = { createSafeFilename };
