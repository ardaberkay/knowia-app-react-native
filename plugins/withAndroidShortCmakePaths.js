const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Expo Config Plugin: kısa CMake ara dosya yolları (Windows yerel build)
 *
 * CMake, node_modules içindeki C++ kaynaklarının ara dosyalarını (.o) kaynağın
 * tam yolunu adına gömerek üretir. Proje yolu bu yüzden iki kez geçer ve
 * react-native-gesture-handler 3'ün derin codegen dosyaları Windows'un 260
 * karakter sınırını aşar ("Filename longer than 260 characters").
 *
 * CMAKE_OBJECT_PATH_MAX=240 ile 240 karakteri aşan ara dosya adları CMake
 * tarafından kısa bir hash'e çevrilir (Windows hedefli projelerde CMake bunu
 * zaten 250 ile yapar; Android hedefinde varsayılan 1000 olduğu için yapmaz).
 * Mac/Linux (EAS) build'lerinde zararsızdır.
 */
const ARG = '-DCMAKE_OBJECT_PATH_MAX=240';

module.exports = function withAndroidShortCmakePaths(config) {
  return withAppBuildGradle(config, (config) => {
    const gradle = config.modResults;
    if (gradle.language !== 'groovy') {
      console.warn('withAndroidShortCmakePaths: build.gradle groovy değil, atlandı');
      return config;
    }
    if (gradle.contents.includes(ARG)) return config;

    const anchor = /defaultConfig\s*\{\n/;
    if (!anchor.test(gradle.contents)) {
      console.warn('withAndroidShortCmakePaths: defaultConfig bulunamadı');
      return config;
    }
    gradle.contents = gradle.contents.replace(
      anchor,
      (match) =>
        match +
        '        externalNativeBuild {\n' +
        '            cmake {\n' +
        `                arguments "${ARG}"\n` +
        '            }\n' +
        '        }\n'
    );
    return config;
  });
};
