export const cardUtils = {
	formatCardNumber: (value: string): string => {
		const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
		const matches = v.match(/\d{4,16}/g);
		const match = matches?.[0] || '';
		const parts = [];

		for (let i = 0, len = match.length; i < len; i += 4) {
			parts.push(match.substring(i, i + 4));
		}

		return parts.length > 0 ? parts.join(' ') : value;
	},

	formatExpiryDate: (value: string): string => {
		const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
		if (v.length >= 2) {
			return `${v.substring(0, 2)}/${v.substring(2, 4)}`;
		}
		return v;
	}
};
