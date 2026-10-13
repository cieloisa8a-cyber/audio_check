plugins {
    id("com.android.application")
}

android {
    namespace = "com.audiocheck.app"
    compileSdk {
        version = release(37)
    }

    defaultConfig {
        applicationId = "com.audiocheck.app"
        minSdk = 29
        targetSdk = 37
        versionCode = 1
        versionName = "1.0"
    }

    sourceSets.getByName("main").assets.setSrcDirs(listOf("../../frontend"))

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}
