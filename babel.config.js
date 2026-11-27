module.exports = function (api) {
  api.cache(true);
  
  // Production'da console.log'ları kaldır (error ve warn hariç)
  const removeConsolePlugin = process.env.NODE_ENV === 'production' 
    ? ['transform-remove-console', { exclude: ['error', 'warn'] }] 
    : null;

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      removeConsolePlugin,
      'react-native-reanimated/plugin',
    ].filter(Boolean),
  };
};