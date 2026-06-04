export const posterUrl = (path, size = 'w300') =>
	path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
