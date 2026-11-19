plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val buildNo = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()

android {
    namespace = "com.ludodhamaal.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.ludodhamaal.app"
        minSdk = 26
        targetSdk = 34
        versionCode = buildNo
        versionName = "1.0.$buildNo"
    }

    signingConfigs {
        create("pilot") {
            storeFile = file("../signing/ludo-pilot.jks")
            storePassword = "ludodhamaal"
            keyAlias = "ludo"
            keyPassword = "ludodhamaal"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("pilot")
        }
        debug {
            signingConfig = signingConfigs.getByName("pilot")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }

    androidResources { noCompress += listOf("js", "css", "html", "ttf") }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.webkit:webkit:1.11.0")
}
