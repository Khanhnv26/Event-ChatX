package com.eventchat.modules.attachment.service.impl;

import com.eventchat.common.exception.UnsupportedAttachmentTypeException;
import com.eventchat.modules.attachment.config.AttachmentScanProperties;
import com.eventchat.modules.attachment.model.ProcessedAttachment;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.ByteBuffer;
import java.nio.charset.*;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

@Component
@RequiredArgsConstructor
public class AttachmentContentValidator {
    private final AttachmentScanProperties properties;

    public ProcessedAttachment validate(byte[] content, String declaredType) throws IOException {
        if (declaredType.startsWith("image/")) return normalizeImage(content, declaredType);
        if (declaredType.equals("application/pdf")) {
            String header = new String(content, 0, Math.min(8, content.length), StandardCharsets.US_ASCII);
            String tail = new String(content, Math.max(0, content.length - 1024), Math.min(1024, content.length), StandardCharsets.US_ASCII);
            if (!header.startsWith("%PDF-") || !tail.contains("%%EOF")) throw new UnsupportedAttachmentTypeException();
        } else if (declaredType.startsWith("application/vnd.openxmlformats-officedocument.")) {
            validateOffice(content, declaredType);
        } else if (declaredType.equals("text/plain") || declaredType.equals("text/csv")) {
            String text = StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(content)).toString();
            if (text.codePoints().anyMatch(value -> Character.isISOControl(value) && value != '\n' && value != '\r' && value != '\t')) {
                throw new UnsupportedAttachmentTypeException();
            }
        } else {
            throw new UnsupportedAttachmentTypeException();
        }
        return new ProcessedAttachment(declaredType, content, null, null, null);
    }

    private ProcessedAttachment normalizeImage(byte[] content, String declaredType) throws IOException {
        try (ImageInputStream input = ImageIO.createImageInputStream(new ByteArrayInputStream(content))) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) throw new UnsupportedAttachmentTypeException();
            ImageReader reader = readers.next();
            try {
                reader.setInput(input, true, true);
                String format = reader.getFormatName().toLowerCase(Locale.ROOT);
                String detected = format.equals("png") ? "image/png" : format.equals("jpeg") ? "image/jpeg" : "";
                if (!detected.equals(declaredType)) throw new UnsupportedAttachmentTypeException();
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                if (width <= 0 || height <= 0 || (long) width * height > properties.getMaxImagePixels()) {
                    throw new UnsupportedAttachmentTypeException();
                }
                BufferedImage decoded = reader.read(0);
                BufferedImage normalized = new BufferedImage(width, height,
                        detected.equals("image/png") ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB);
                Graphics2D graphics = normalized.createGraphics();
                try { graphics.drawImage(decoded, 0, 0, null); } finally { graphics.dispose(); }
                ByteArrayOutputStream output = new ByteArrayOutputStream();
                if (!ImageIO.write(normalized, format, output)) throw new UnsupportedAttachmentTypeException();
                double scale = Math.min(1, 480.0 / Math.max(width, height));
                BufferedImage thumbnail = new BufferedImage(Math.max(1, (int) (width * scale)),
                        Math.max(1, (int) (height * scale)), BufferedImage.TYPE_INT_RGB);
                Graphics2D thumbnailGraphics = thumbnail.createGraphics();
                try {
                    thumbnailGraphics.setColor(Color.WHITE);
                    thumbnailGraphics.fillRect(0, 0, thumbnail.getWidth(), thumbnail.getHeight());
                    thumbnailGraphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
                    thumbnailGraphics.drawImage(normalized, 0, 0, thumbnail.getWidth(), thumbnail.getHeight(), null);
                } finally { thumbnailGraphics.dispose(); }
                ByteArrayOutputStream preview = new ByteArrayOutputStream();
                ImageIO.write(thumbnail, "jpeg", preview);
                if (preview.size() > 512 * 1024) throw new UnsupportedAttachmentTypeException();
                return new ProcessedAttachment(detected, output.toByteArray(), preview.toByteArray(), width, height);
            } finally { reader.dispose(); }
        }
    }

    private void validateOffice(byte[] content, String declaredType) throws IOException {
        String mainPart = declaredType.endsWith("wordprocessingml.document") ? "word/document.xml"
                : declaredType.endsWith("spreadsheetml.sheet") ? "xl/workbook.xml" : "ppt/presentation.xml";
        Set<String> entries = new HashSet<>();
        long expanded = 0;
        boolean contentTypes = false;
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(content))) {
            ZipEntry entry;
            byte[] buffer = new byte[8192];
            while ((entry = zip.getNextEntry()) != null) {
                String name = entry.getName();
                if (entries.size() >= 1000 || !entries.add(name) || name.startsWith("/") || name.contains("..")
                        || name.contains("\\") || name.toLowerCase(Locale.ROOT).endsWith("vbaproject.bin")) {
                    throw new UnsupportedAttachmentTypeException();
                }
                ByteArrayOutputStream types = name.equals("[Content_Types].xml") ? new ByteArrayOutputStream() : null;
                int count;
                while ((count = zip.read(buffer)) != -1) {
                    expanded += count;
                    if (expanded > 64L * 1024 * 1024 || types != null && types.size() + count > 1024 * 1024) {
                        throw new UnsupportedAttachmentTypeException();
                    }
                    if (types != null) types.write(buffer, 0, count);
                }
                if (types != null) {
                    String xml = types.toString(StandardCharsets.UTF_8);
                    String rootType = declaredType + ".main+xml";
                    contentTypes = xml.contains(rootType) && !xml.contains("macroEnabled");
                }
            }
        }
        if (!contentTypes || !entries.contains(mainPart) || !entries.contains("_rels/.rels")) {
            throw new UnsupportedAttachmentTypeException();
        }
    }
}
